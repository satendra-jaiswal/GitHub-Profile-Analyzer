const axios = require("axios");
require("dotenv").config();

const githubApi = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN && {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    }),
  },
  timeout: 10000,
});

/**
 * Fetch a GitHub user's public profile
 */
const fetchUserProfile = async (username) => {
  try {
    const { data } = await githubApi.get(`/users/${username}`);
    return data;
  } catch (err) {
    if (err.response?.status === 404) {
      const e = new Error(`GitHub user "${username}" not found`);
      e.statusCode = 404;
      throw e;
    }
    if (err.response?.status === 403) {
      const e = new Error("GitHub API rate limit exceeded. Set GITHUB_TOKEN in .env to increase limits.");
      e.statusCode = 429;
      throw e;
    }
    throw new Error(`GitHub API error: ${err.message}`);
  }
};

/**
 * Fetch all public repositories for a user (auto-paginate up to 500)
 */
const fetchUserRepos = async (username) => {
  const repos = [];
  let page = 1;
  const perPage = 100;

  while (repos.length < 500) {
    const { data } = await githubApi.get(`/users/${username}/repos`, {
      params: { per_page: perPage, page, sort: "pushed", type: "owner" },
    });
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return repos;
};

/**
 * Analyze repos and compute aggregated insights
 */
const analyzeRepos = (repos) => {
  const languageMap = {};
  let totalStars = 0;
  let totalForks = 0;
  let totalWatchers = 0;
  let totalOpenIssues = 0;

  for (const repo of repos) {
    totalStars += repo.stargazers_count || 0;
    totalForks += repo.forks_count || 0;
    totalWatchers += repo.watchers_count || 0;
    totalOpenIssues += repo.open_issues_count || 0;

    if (repo.language) {
      languageMap[repo.language] = (languageMap[repo.language] || 0) + 1;
    }
  }

  // Top 5 repos by stars
  const topRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5);

  // Sorted languages
  const languages = Object.entries(languageMap)
    .sort((a, b) => b[1] - a[1])
    .map(([language, repo_count]) => ({ language, repo_count }));

  return { totalStars, totalForks, totalWatchers, totalOpenIssues, languages, topRepos };
};

/**
 * Compute a composite activity score (0–100)
 */
const computeActivityScore = ({ profile, repoStats }) => {
  const { followers, following, public_repos, public_gists } = profile;
  const { totalStars, totalForks } = repoStats;

  // Weighted scoring
  const followerScore = Math.min(followers / 1000, 1) * 30;
  const starScore = Math.min(totalStars / 500, 1) * 25;
  const repoScore = Math.min(public_repos / 50, 1) * 20;
  const forkScore = Math.min(totalForks / 200, 1) * 15;
  const gistScore = Math.min(public_gists / 20, 1) * 5;
  const engagementBonus = following > 0 ? Math.min((followers / following) / 10, 1) * 5 : 0;

  return parseFloat((followerScore + starScore + repoScore + forkScore + gistScore + engagementBonus).toFixed(2));
};

module.exports = { fetchUserProfile, fetchUserRepos, analyzeRepos, computeActivityScore };
