document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const searchForm = document.getElementById("search-form");
  const usernameInput = document.getElementById("username-input");
  const searchBtn = document.getElementById("search-btn");
  const apiStatusMsg = document.getElementById("api-status-msg");
  
  const welcomeView = document.getElementById("welcome-view");
  const loadingView = document.getElementById("loading-view");
  const analysisView = document.getElementById("analysis-view");
  
  // Profile elements
  const profileAvatar = document.getElementById("profile-avatar");
  const profileName = document.getElementById("profile-name");
  const profileType = document.getElementById("profile-type");
  const profileHireable = document.getElementById("profile-hireable");
  const profileUsername = document.getElementById("profile-username");
  const profileBio = document.getElementById("profile-bio");
  const profileLocation = document.getElementById("profile-location");
  const profileCompany = document.getElementById("profile-company");
  const profileBlog = document.getElementById("profile-blog");
  const profileAge = document.getElementById("profile-age");
  
  // Stats counters
  const statRepos = document.getElementById("stat-repos");
  const statFollowers = document.getElementById("stat-followers");
  const statFollowing = document.getElementById("stat-following");
  const statStars = document.getElementById("stat-stars");
  const statForks = document.getElementById("stat-forks");
  const activityScore = document.getElementById("activity-score");
  
  // Insights & Repos
  const languagesList = document.getElementById("languages-list");
  const insightTopLang = document.getElementById("insight-top-lang");
  const insightAvgStars = document.getElementById("insight-avg-stars");
  const insightAvgForks = document.getElementById("insight-avg-forks");
  const insightRatio = document.getElementById("insight-ratio");
  const reposGrid = document.getElementById("repos-grid");
  
  // Footer actions
  const githubProfileLink = document.getElementById("github-profile-link");

  let currentActiveUser = null;

  // Suggestions listener
  document.querySelectorAll(".suggestion-tag").forEach(tag => {
    tag.addEventListener("click", () => {
      usernameInput.value = tag.textContent;
      triggerSearch(tag.textContent);
    });
  });

  // Search form submission
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username) {
      triggerSearch(username);
    }
  });

  // Trigger search pipeline
  async function triggerSearch(username) {
    hideStatusMessage();
    showLoadingView();

    try {
      const response = await fetch(`/api/profiles/analyze/${username}`, {
        method: "POST"
      });
      const result = await response.json();

      if (result.success) {
        // Direct render from search result payload (contains full analytics)
        renderProfile(result.data);
      } else {
        showStatusMessage(result.message, "error");
        showWelcomeView();
      }
    } catch (err) {
      console.error(err);
      showStatusMessage("Failed to reach server. Please try again.", "error");
      showWelcomeView();
    }
  }

  // Render Full Profile Dashboard Insights
  function renderProfile(profile) {
    currentActiveUser = profile.username;
    
    // Core details
    profileAvatar.src = profile.avatar_url || "";
    profileName.textContent = profile.name || profile.username;
    profileUsername.textContent = `@${profile.username}`;
    profileBio.textContent = profile.bio || "No biography provided.";
    
    // Set account type badge
    profileType.textContent = profile.account_type || "User";
    
    // Set hireable badge
    if (profile.is_hireable) {
      profileHireable.classList.remove("hidden");
    } else {
      profileHireable.classList.add("hidden");
    }

    // Set metadata items
    setMetadata(profileLocation, "meta-location-wrapper", profile.location);
    setMetadata(profileCompany, "meta-company-wrapper", profile.company);
    
    if (profile.blog) {
      document.getElementById("meta-blog-wrapper").classList.remove("hidden");
      profileBlog.href = profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`;
      profileBlog.textContent = profile.blog.replace(/(^\w+:|^)\/\//, ''); // Clean URL for display
    } else {
      document.getElementById("meta-blog-wrapper").classList.add("hidden");
    }

    profileAge.textContent = `${formatNumber(profile.account_age_days)} days old`;

    // Numeric Stats
    const stats = profile.latestStats || {};
    statRepos.textContent = formatNumber(stats.public_repos || 0);
    statFollowers.textContent = formatNumber(stats.followers || 0);
    statFollowing.textContent = formatNumber(stats.following || 0);
    statStars.textContent = formatNumber(stats.total_stars || 0);
    statForks.textContent = formatNumber(stats.total_forks || 0);
    activityScore.textContent = parseFloat(profile.activity_score || 0).toFixed(0);

    // Compute and Render Languages progress bars
    renderLanguages(profile.languages);

    // Render Insights row
    insightTopLang.textContent = profile.most_used_language || "None";
    insightAvgStars.textContent = parseFloat(profile.avg_stars_per_repo || 0).toFixed(1);
    insightAvgForks.textContent = parseFloat(profile.avg_forks_per_repo || 0).toFixed(1);
    insightRatio.textContent = parseFloat(profile.follower_following_ratio || 0).toFixed(2);

    // Render Repos Grid
    renderRepositories(profile.topRepos);

    // Footer actions
    githubProfileLink.href = profile.html_url;

    // Show details
    showAnalysisView();
  }

  // Helper: show/hide metadata rows
  function setMetadata(el, wrapperId, val) {
    const wrapper = document.getElementById(wrapperId);
    if (val) {
      wrapper.classList.remove("hidden");
      el.textContent = val;
    } else {
      wrapper.classList.add("hidden");
    }
  }

  // Render Languages list with dynamic widths
  function renderLanguages(languages) {
    if (!languages || languages.length === 0) {
      languagesList.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No code languages found</div>`;
      return;
    }

    // Sum all repo counts to calculate percentages
    const totalReposWithLang = languages.reduce((acc, current) => acc + current.repo_count, 0);

    languagesList.innerHTML = "";
    
    // Only show top 5 languages to keep panel clean
    languages.slice(0, 5).forEach(lang => {
      const percentage = totalReposWithLang > 0 ? ((lang.repo_count / totalReposWithLang) * 100).toFixed(0) : 0;
      
      const langRow = document.createElement("div");
      langRow.className = "lang-row";
      langRow.innerHTML = `
        <div class="lang-meta">
          <span class="lang-name">${lang.language}</span>
          <span class="lang-count">${percentage}% (${lang.repo_count} repos)</span>
        </div>
        <div class="lang-progress-bar-container">
          <div class="lang-progress-bar" style="width: 0%"></div>
        </div>
      `;

      languagesList.appendChild(langRow);

      // Trigger width animation on next tick
      setTimeout(() => {
        const progressBar = langRow.querySelector(".lang-progress-bar");
        if (progressBar) progressBar.style.width = `${percentage}%`;
      }, 50);
    });
  }

  // Render Repository Cards Grid
  function renderRepositories(repos) {
    if (!repos || repos.length === 0) {
      reposGrid.innerHTML = `<div style="grid-column: 1/-1; color: var(--text-secondary); text-align: center; padding: 2rem 0;">No repositories found.</div>`;
      return;
    }

    reposGrid.innerHTML = "";
    repos.forEach(repo => {
      const card = document.createElement("div");
      card.className = "repo-card";
      card.innerHTML = `
        <div class="repo-card-header">
          <h4 class="repo-name" title="${repo.repo_name}">${repo.repo_name}</h4>
          <a href="${repo.html_url}" target="_blank" title="Open repo"><i class="fa-solid fa-up-right-from-square"></i></a>
        </div>
        <p class="repo-desc">${repo.description || "No description provided."}</p>
        <div class="repo-footer">
          <span class="repo-lang">
            <span class="repo-lang-dot" style="background-color: ${getLanguageColor(repo.language)}"></span>
            <span>${repo.language || "Unknown"}</span>
          </span>
          <div class="repo-stats">
            <span><i class="fa-solid fa-star"></i> ${repo.stars}</span>
            <span><i class="fa-solid fa-code-fork"></i> ${repo.forks}</span>
          </div>
        </div>
      `;
      reposGrid.appendChild(card);
    });
  }

  // Helper: format numbers with comma separation (e.g. 15,200)
  function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // Helper: map languages to colors
  function getLanguageColor(lang) {
    const colors = {
      javascript: "#f1e05a",
      typescript: "#3178c6",
      html: "#e34c26",
      css: "#563d7c",
      python: "#3572a5",
      ruby: "#701516",
      java: "#b07219",
      go: "#00add8",
      c: "#555555",
      cpp: "#f34b7d",
      "c++": "#f34b7d",
      "c#": "#178600",
      php: "#4f5d95",
      swift: "#f05138",
      rust: "#dea584",
      shell: "#89e051"
    };
    return colors[(lang || "").toLowerCase()] || "#64748b";
  }

  // View States Control
  function showWelcomeView() {
    welcomeView.classList.remove("hidden");
    loadingView.classList.add("hidden");
    analysisView.classList.add("hidden");
    currentActiveUser = null;
  }

  function showLoadingView() {
    welcomeView.classList.add("hidden");
    loadingView.classList.remove("hidden");
    analysisView.classList.add("hidden");
  }

  function showAnalysisView() {
    welcomeView.classList.add("hidden");
    loadingView.classList.add("hidden");
    analysisView.classList.remove("hidden");
  }

  // UI Status Alerts
  function showStatusMessage(text, type = "info") {
    apiStatusMsg.textContent = text;
    apiStatusMsg.className = `info-alert ${type}`;
    apiStatusMsg.classList.remove("hidden");

    // Auto-hide alert after 8 seconds
    setTimeout(hideStatusMessage, 8000);
  }

  function hideStatusMessage() {
    apiStatusMsg.classList.add("hidden");
    apiStatusMsg.textContent = "";
  }
});
