import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes.js';
import { initDatabase } from './database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendBuildPath = path.join(__dirname, '../frontend/dist');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS so frontend React app can query backend APIs
app.use(cors({
  origin: '*', // For local dev development, allow requests from any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve React production build statically
app.use(express.static(frontendBuildPath));

// Main APIs
app.use('/api', router);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Fallback to React index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Macha Express API Server active. Run frontend build to view UI.');
    }
  });
});

// Startup Database and Server
const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(` Macha Express Backend is active!        `);
      console.log(` Port: ${PORT}                           `);
      console.log(` Status: http://localhost:${PORT}/health `);
      console.log(`=========================================`);
    });
  } catch (err) {
    console.error('Failed to initialize database and start server:', err);
    process.exit(1);
  }
};

startServer();
