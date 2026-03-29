const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const searchController = require('../controllers/search.controller');

router.get('/', authenticate, searchController.search);

module.exports = router;
