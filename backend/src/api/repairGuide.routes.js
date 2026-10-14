import { Router } from 'express';
import { getRepairGuide } from '../repair/guide.js';

export function repairGuideRoutes({ pool }) {
  const router = Router();

  const handleGetRepairGuide = async (req, res) => {
    const { faultSignature } = req.params;

    try {
      const result = await getRepairGuide(pool, faultSignature);

      if (result.status === 'invalid_signature') {
        return res.status(400).json({
          error: 'invalid fault signature',
          allowed: result.allowed,
        });
      }

      if (result.status === 'no_approved_procedure') {
        return res.status(404).json({
          error: 'no approved procedure for signature',
        });
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error([err.name, err.code].filter(Boolean).join(' '));
      return res.status(500).json({ error: 'internal error' });
    }
  };

  router.get('/api/repair-guide/:faultSignature', handleGetRepairGuide);

  return router;
}
