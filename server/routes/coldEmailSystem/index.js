import express from 'express';
import accountsRoutes from './accounts.js';
import leadsRoutes from './leads.js';
import categoriesRoutes from './categories.js';

const router = express.Router();

// Mount sub-routes
router.use('/accounts', accountsRoutes);
router.use('/leads', leadsRoutes);
router.use('/lead-categories', categoriesRoutes);

export default router;