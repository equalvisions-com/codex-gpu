DROP INDEX "gpu_pricing_provider_priority_idx";--> statement-breakpoint
CREATE INDEX "gpu_pricing_provider_priority_idx" ON "gpu_pricing" USING btree ((array_position(
      ARRAY['coreweave','lambda','runpod','digitalocean','oracle','nebius','hyperstack','crusoe','flyio','vultr','latitude','ori','voltagepark','googlecloud','verda','scaleway','replicate','thundercompute','koyeb','sesterce','aws','azure','civo','vast','hotaisle','alibaba','oblivus','paperspace','togetherai'],
      lower("provider")
    )),lower("provider"));