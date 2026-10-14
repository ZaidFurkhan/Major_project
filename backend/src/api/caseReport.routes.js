import { Router } from 'express';
import { loadCaseReport } from '../db/caseReport.js';
import { buildCaseReport, renderCaseReportText } from '../report/buildCaseReport.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function caseReportRoutes({ pool }) {
  const router = Router();

  const handleGetReport = async (req, res) => {
    const { id } = req.params;
    const { format } = req.query;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'invalid case id' });
    }

    try {
      const data = await loadCaseReport(pool, id);
      const report = buildCaseReport(data);

      if (report.status === 'not_found') {
        return res.status(404).json({ error: 'case not found' });
      }

      if (format === 'text') {
        const text = renderCaseReportText(report);
        return res.status(200).type('text/plain').send(text);
      }

      return res.status(200).json(report);
    } catch (err) {
      console.error([err.name, err.code].filter(Boolean).join(' '));
      return res.status(500).json({ error: 'internal error' });
    }
  };

  router.get('/api/cases/:id/report', handleGetReport);

  return router;
}
