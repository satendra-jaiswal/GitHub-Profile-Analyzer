const { Router } = require("express");
const { param } = require("express-validator");
const { analyzeProfile, listProfiles, getProfile, removeProfile } = require("../controllers/profileController");
const { validateRequest } = require("../middleware/validateRequest");

const router = Router();

const usernameValidation = [
  param("username")
    .trim()
    .notEmpty().withMessage("Username is required")
    .matches(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/)
    .withMessage("Invalid GitHub username format"),
  validateRequest,
];

/**
 * @route   POST /api/profiles/analyze/:username
 * @desc    Analyze a GitHub profile and store insights
 * @access  Public
 */
router.post("/analyze/:username", usernameValidation, analyzeProfile);

/**
 * @route   GET /api/profiles
 * @desc    Get all analyzed profiles (paginated)
 * @access  Public
 * @query   page, limit, sort (username|analyzed_at|followers|total_stars|activity_score), order (ASC|DESC)
 */
router.get("/", listProfiles);

/**
 * @route   GET /api/profiles/:username
 * @desc    Get a single analyzed profile with full details
 * @access  Public
 */
router.get("/:username", usernameValidation, getProfile);

/**
 * @route   DELETE /api/profiles/:username
 * @desc    Delete a profile from the database
 * @access  Public
 */
router.delete("/:username", usernameValidation, removeProfile);

module.exports = router;
