import { createApp } from './app.js';

const rawPort = process.env.PORT;
let port = 3000;
if (rawPort !== undefined && rawPort.trim() !== '') {
  const num = Number(rawPort);
  if (Number.isInteger(num) && num > 0) {
    port = num;
  }
}

const app = createApp();

app.listen(port, () => {
  console.log(`backend listening on port ${port}`);
});
