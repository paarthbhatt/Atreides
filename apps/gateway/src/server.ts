import { server } from "./index.js";

server.listen(Number(process.env.PORT ?? 4100), () => {
  console.log("Atreides gateway listening on :4100");
});
