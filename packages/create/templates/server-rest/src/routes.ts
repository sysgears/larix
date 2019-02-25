import { Express } from 'express';

export default (app: Express) => {
  /**
   * @swagger
   * /:
   *   get:
   *     description: Returns the homepage
   *     responses:
   *       200:
   *         description: hello world
   */
  app.get('/', (req, res) => {
    res.redirect('/api/swagger');
  });

  /**
   * @swagger
   * /api/hello:
   *   get:
   *     description: Returns hello message
   *     parameters:
   *       - name: subject
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         content:
   *           application/json:
   *             schema:
   *               type: string
   */
  app.get('/api/hello', (req, res) => {
    res.json({ message: `Hello ${req.query.subject} from Server!` });
  });
};
