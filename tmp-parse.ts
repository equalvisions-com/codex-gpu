import { searchParamsCache } from "./src/components/infinite-table/search-params";

async function main() {
  const params = new URLSearchParams();
  params.set("gpu_model", "NVIDIA A10");
  const result = await searchParamsCache.parse(Object.fromEntries(params));
  console.log(result);
}

main();
