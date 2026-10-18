import { config } from './config.js';
import { connectDb } from './db.js';
import { bootstrap } from './seed/bootstrap.js';
import { createApp } from './app.js';

await connectDb();
await bootstrap();
console.log('MongoDB connected');
createApp().listen(config.port, () => console.log(`API on http://localhost:${config.port}`));
