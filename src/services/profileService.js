const { pool } = require("../config/database");
const {
  fetchUserProfile,
  fetchUserRepos,
  analyzeRepos,
  computeActivityScore,
} = require("./githubService");

/**
 * Full pipeline: fetch → analyze → upsert into DB
 */
const analyzeAndStore = async (username) => {
  // 1. Fetch from GitHub
  const ghProfile = await fetchUserProfile(username);
  const repos = await fetchUserRepos(username);
  const repoStats = analyzeRepos(repos);

  const accountAgeDays = Math.floor(
    (Date.now() - new Date(ghProfile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const repoCount = ghProfile.public_repos || 0;
  const activityScore = computeActivityScore({ profile: ghProfile, repoStats });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 2. Upsert profile
    const [profileResult] = await conn.execute(
      `INSERT INTO profiles
        (username, github_id, name, bio, avatar_url, html_url, location, company,
         blog, email, twitter_handle, account_type, is_hireable, created_at_github)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        github_id=VALUES(github_id), name=VALUES(name), bio=VALUES(bio),
        avatar_url=VALUES(avatar_url), html_url=VALUES(html_url), location=VALUES(location),
        company=VALUES(company), blog=VALUES(blog), email=VALUES(email),
        twitter_handle=VALUES(twitter_handle), account_type=VALUES(account_type),
        is_hireable=VALUES(is_hireable), created_at_github=VALUES(created_at_github),
        updated_at=CURRENT_TIMESTAMP`,
      [
        ghProfile.login,
        ghProfile.id,
        ghProfile.name || null,
        ghProfile.bio || null,
        ghProfile.avatar_url,
        ghProfile.html_url,
        ghProfile.location || null,
        ghProfile.company || null,
        ghProfile.blog || null,
        ghProfile.email || null,
        ghProfile.twitter_username || null,
        ghProfile.type || "User",
        ghProfile.hireable ? 1 : 0,
        new Date(ghProfile.created_at),
      ]
    );

    // Resolve profileId (works for both INSERT and UPDATE)
    let profileId = profileResult.insertId;
    if (!profileId) {
      const [rows] = await conn.execute("SELECT id FROM profiles WHERE username = ?", [ghProfile.login]);
      profileId = rows[0].id;
    }

    // 3. Insert stats snapshot
    await conn.execute(
      `INSERT INTO profile_stats
        (profile_id, public_repos, public_gists, followers, following,
         total_stars, total_forks, total_watchers, total_open_issues)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profileId,
        ghProfile.public_repos || 0,
        ghProfile.public_gists || 0,
        ghProfile.followers || 0,
        ghProfile.following || 0,
        repoStats.totalStars,
        repoStats.totalForks,
        repoStats.totalWatchers,
        repoStats.totalOpenIssues,
      ]
    );

    // 4. Replace languages
    await conn.execute("DELETE FROM profile_languages WHERE profile_id = ?", [profileId]);
    for (const lang of repoStats.languages) {
      await conn.execute(
        `INSERT INTO profile_languages (profile_id, language, repo_count) VALUES (?, ?, ?)`,
        [profileId, lang.language, lang.repo_count]
      );
    }

    // 5. Replace top repos
    await conn.execute("DELETE FROM top_repositories WHERE profile_id = ?", [profileId]);
    for (const repo of repoStats.topRepos) {
      await conn.execute(
        `INSERT INTO top_repositories
          (profile_id, repo_name, full_name, description, html_url, language,
           stars, forks, watchers, open_issues, is_fork, created_at_github, pushed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          repo.name,
          repo.full_name,
          repo.description || null,
          repo.html_url,
          repo.language || null,
          repo.stargazers_count || 0,
          repo.forks_count || 0,
          repo.watchers_count || 0,
          repo.open_issues_count || 0,
          repo.fork ? 1 : 0,
          repo.created_at ? new Date(repo.created_at) : null,
          repo.pushed_at ? new Date(repo.pushed_at) : null,
        ]
      );
    }

    // 6. Upsert activity summary
    await conn.execute(
      `INSERT INTO profile_activity
        (profile_id, account_age_days, avg_stars_per_repo, avg_forks_per_repo,
         follower_following_ratio, most_used_language, activity_score)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        account_age_days=VALUES(account_age_days),
        avg_stars_per_repo=VALUES(avg_stars_per_repo),
        avg_forks_per_repo=VALUES(avg_forks_per_repo),
        follower_following_ratio=VALUES(follower_following_ratio),
        most_used_language=VALUES(most_used_language),
        activity_score=VALUES(activity_score)`,
      [
        profileId,
        accountAgeDays,
        repoCount > 0 ? parseFloat((repoStats.totalStars / repoCount).toFixed(2)) : 0,
        repoCount > 0 ? parseFloat((repoStats.totalForks / repoCount).toFixed(2)) : 0,
        ghProfile.following > 0
          ? parseFloat((ghProfile.followers / ghProfile.following).toFixed(2))
          : ghProfile.followers,
        repoStats.languages[0]?.language || null,
        activityScore,
      ]
    );

    await conn.commit();
    return getProfileById(profileId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Get all analyzed profiles with latest stats
 */
const getAllProfiles = async ({ page = 1, limit = 20, sort = "analyzed_at", order = "DESC" } = {}) => {
  const sortMap = {
    analyzed_at: "p.analyzed_at",
    username: "p.username",
    followers: "ps.followers",
    total_stars: "ps.total_stars",
    activity_score: "pa.activity_score",
  };
  const safeSort = sortMap[sort] || "p.analyzed_at";
  const safeOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT
       p.id, p.username, p.name, p.avatar_url, p.html_url, p.location, p.bio,
       p.account_type, p.analyzed_at, p.updated_at,
       ps.public_repos, ps.followers, ps.following, ps.total_stars, ps.total_forks,
       pa.activity_score, pa.most_used_language, pa.account_age_days
     FROM profiles p
     LEFT JOIN profile_stats ps ON ps.id = (
       SELECT id FROM profile_stats
       WHERE profile_id = p.id
       ORDER BY recorded_at DESC
       LIMIT 1
     )
     LEFT JOIN profile_activity pa ON pa.profile_id = p.id
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const [[{ total }]] = await pool.execute("SELECT COUNT(*) AS total FROM profiles");

  return {
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Get a single profile by username with full detail
 */
const getProfileByUsername = async (username) => {
  const [[profile]] = await pool.execute(
    `SELECT p.*, pa.account_age_days, pa.avg_stars_per_repo, pa.avg_forks_per_repo,
            pa.follower_following_ratio, pa.most_used_language, pa.activity_score
     FROM profiles p
     LEFT JOIN profile_activity pa ON pa.profile_id = p.id
     WHERE p.username = ?`,
    [username]
  );

  if (!profile) return null;

  const [[latestStats]] = await pool.execute(
    `SELECT * FROM profile_stats WHERE profile_id = ? ORDER BY recorded_at DESC LIMIT 1`,
    [profile.id]
  );

  const [languages] = await pool.execute(
    `SELECT language, repo_count FROM profile_languages WHERE profile_id = ? ORDER BY repo_count DESC`,
    [profile.id]
  );

  const [topRepos] = await pool.execute(
    `SELECT * FROM top_repositories WHERE profile_id = ? ORDER BY stars DESC`,
    [profile.id]
  );

  const [statsHistory] = await pool.execute(
    `SELECT public_repos, followers, following, total_stars, total_forks, recorded_at
     FROM profile_stats WHERE profile_id = ? ORDER BY recorded_at DESC LIMIT 10`,
    [profile.id]
  );

  return { ...profile, latestStats, languages, topRepos, statsHistory };
};

const getProfileById = async (id) => {
  const [[profile]] = await pool.execute(
    `SELECT p.*, pa.account_age_days, pa.avg_stars_per_repo, pa.avg_forks_per_repo,
            pa.follower_following_ratio, pa.most_used_language, pa.activity_score
     FROM profiles p
     LEFT JOIN profile_activity pa ON pa.profile_id = p.id
     WHERE p.id = ?`,
    [id]
  );
  return profile || null;
};

/**
 * Delete a profile and all related data
 */
const deleteProfile = async (username) => {
  const [[profile]] = await pool.execute("SELECT id FROM profiles WHERE username = ?", [username]);
  if (!profile) return false;
  await pool.execute("DELETE FROM profiles WHERE id = ?", [profile.id]);
  return true;
};

module.exports = { analyzeAndStore, getAllProfiles, getProfileByUsername, deleteProfile };
