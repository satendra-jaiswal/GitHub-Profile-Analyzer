const mysql = require("mysql2/promise");
require("dotenv").config();

const migrate = async () => {
  let conn;
  try {
    // Connect WITHOUT selecting a database first
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });

    const dbName = process.env.DB_NAME || "github_analyzer";
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await conn.query(`USE \`${dbName}\``);
    console.log(`✅ Database "${dbName}" ready`);

    // profiles table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        username      VARCHAR(100) NOT NULL UNIQUE,
        github_id     BIGINT NOT NULL UNIQUE,
        name          VARCHAR(255),
        bio           TEXT,
        avatar_url    VARCHAR(500),
        html_url      VARCHAR(500),
        location      VARCHAR(255),
        company       VARCHAR(255),
        blog          VARCHAR(500),
        email         VARCHAR(255),
        twitter_handle VARCHAR(100),
        account_type  ENUM('User','Organization') DEFAULT 'User',
        is_hireable   TINYINT(1) DEFAULT 0,
        created_at_github DATETIME,
        analyzed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_analyzed_at (analyzed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Table `profiles` ready");

    // stats table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS profile_stats (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        profile_id            INT NOT NULL,
        public_repos          INT DEFAULT 0,
        public_gists          INT DEFAULT 0,
        followers             INT DEFAULT 0,
        following             INT DEFAULT 0,
        total_stars           INT DEFAULT 0,
        total_forks           INT DEFAULT 0,
        total_watchers        INT DEFAULT 0,
        total_open_issues     INT DEFAULT 0,
        recorded_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        INDEX idx_profile_id (profile_id),
        INDEX idx_recorded_at (recorded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Table `profile_stats` ready");

    // language breakdown table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS profile_languages (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        profile_id  INT NOT NULL,
        language    VARCHAR(100) NOT NULL,
        repo_count  INT DEFAULT 0,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        UNIQUE KEY uq_profile_language (profile_id, language),
        INDEX idx_profile_id (profile_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Table `profile_languages` ready");

    // top repos table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS top_repositories (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        profile_id    INT NOT NULL,
        repo_name     VARCHAR(255) NOT NULL,
        full_name     VARCHAR(500),
        description   TEXT,
        html_url      VARCHAR(500),
        language      VARCHAR(100),
        stars         INT DEFAULT 0,
        forks         INT DEFAULT 0,
        watchers      INT DEFAULT 0,
        open_issues   INT DEFAULT 0,
        is_fork       TINYINT(1) DEFAULT 0,
        created_at_github DATETIME,
        pushed_at     DATETIME,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
        INDEX idx_profile_id (profile_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Table `top_repositories` ready");

    // activity summary table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS profile_activity (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        profile_id            INT NOT NULL UNIQUE,
        account_age_days      INT DEFAULT 0,
        avg_stars_per_repo    DECIMAL(10,2) DEFAULT 0.00,
        avg_forks_per_repo    DECIMAL(10,2) DEFAULT 0.00,
        follower_following_ratio DECIMAL(10,2) DEFAULT 0.00,
        most_used_language    VARCHAR(100),
        activity_score        DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Composite score 0-100',
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Table `profile_activity` ready");

    console.log("\n🚀 All migrations completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
};

migrate();
