const {
  fetchUserProfile,
  fetchUserRepos,
  analyzeRepos,
  computeActivityScore,
} = require("./githubService");

/**
 * Full pipeline: fetch → analyze → return formatted object without writing to database.
 */
const analyzeAndStore = async (username) => {
  // 1. Fetch from GitHub directly on-the-fly
  const ghProfile = await fetchUserProfile(username);
  const repos = await fetchUserRepos(username);
  const repoStats = analyzeRepos(repos);

  const accountAgeDays = Math.floor(
    (Date.now() - new Date(ghProfile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const repoCount = ghProfile.public_repos || 0;
  const activityScore = computeActivityScore({ profile: ghProfile, repoStats });

  // 2. Format the response object to match the exact schema the frontend expects
  const profileData = {
    id: ghProfile.id,
    username: ghProfile.login,
    github_id: ghProfile.id,
    name: ghProfile.name || ghProfile.login,
    bio: ghProfile.bio || null,
    avatar_url: ghProfile.avatar_url,
    html_url: ghProfile.html_url,
    location: ghProfile.location || null,
    company: ghProfile.company || null,
    blog: ghProfile.blog || null,
    email: ghProfile.email || null,
    twitter_handle: ghProfile.twitter_username || null,
    account_type: ghProfile.type || "User",
    is_hireable: ghProfile.hireable ? 1 : 0,
    created_at_github: ghProfile.created_at,
    analyzed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    
    // Computed activity indicators
    account_age_days: accountAgeDays,
    avg_stars_per_repo: repoCount > 0 ? parseFloat((repoStats.totalStars / repoCount).toFixed(2)) : 0,
    avg_forks_per_repo: repoCount > 0 ? parseFloat((repoStats.totalForks / repoCount).toFixed(2)) : 0,
    follower_following_ratio: ghProfile.following > 0
      ? parseFloat((ghProfile.followers / ghProfile.following).toFixed(2))
      : ghProfile.followers,
    most_used_language: repoStats.languages[0]?.language || null,
    activity_score: activityScore,

    // Statistics block
    latestStats: {
      public_repos: ghProfile.public_repos || 0,
      public_gists: ghProfile.public_gists || 0,
      followers: ghProfile.followers || 0,
      following: ghProfile.following || 0,
      total_stars: repoStats.totalStars,
      total_forks: repoStats.totalForks,
      total_watchers: repoStats.totalWatchers,
      total_open_issues: repoStats.totalOpenIssues,
    },
    languages: repoStats.languages,
    topRepos: repoStats.topRepos.map(repo => ({
      repo_name: repo.name,
      full_name: repo.full_name,
      description: repo.description || null,
      html_url: repo.html_url,
      language: repo.language || null,
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      watchers: repo.watchers_count || 0,
      open_issues: repo.open_issues_count || 0,
      is_fork: repo.fork ? 1 : 0,
      created_at_github: repo.created_at,
      pushed_at: repo.pushed_at,
    })),
    statsHistory: [] // Stateless: no historical entries
  };

  return profileData;
};

/**
 * Get all analyzed profiles - Returns empty array because we don't store inputs anymore.
 */
const getAllProfiles = async () => {
  return {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
};

/**
 * Get a single profile by username - Fetches and analyzes fresh from GitHub API.
 */
const getProfileByUsername = async (username) => {
  return analyzeAndStore(username);
};

/**
 * Delete a profile - Stateless success response since nothing is stored.
 */
const deleteProfile = async (username) => {
  return true;
};

module.exports = { analyzeAndStore, getAllProfiles, getProfileByUsername, deleteProfile };
