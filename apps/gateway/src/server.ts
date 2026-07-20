import { server } from "./index.js";

const port = Number(process.env.PORT ?? 4100);
server.listen(port, () => {
  console.log(`Atreides gateway listening on :${port}`);
});
