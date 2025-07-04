// ES-module copy of Cloudflare KV Vector Store
// This is identical to cloudflareKVVectorStore.js but saved as .mjs so that
// local Node scripts (which run in ESM mode) can import it without changing
// the rest of the production code.

const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
};

const cloudflareKVVectorStore = {
    async upsert(embeddings, env) {
        if (!env.VECTOR_STORE_KV) {
            throw new Error('VECTOR_STORE_KV binding not configured');
        }
        const kv = env.VECTOR_STORE_KV;
        const ops = embeddings.map(async (embedding) => {
            const key = `vector:${embedding.id}`;
            await kv.put(key, JSON.stringify(embedding));
        });
        await Promise.all(ops);

        // maintain per-project index
        const projectId = embeddings[0]?.metadata?.projectId;
        if (projectId) {
            const indexKey = `project_index:${projectId}`;
            const existing = (await kv.get(indexKey, 'json')) || [];
            const updated = [...new Set([...existing, ...embeddings.map(e => e.id)])];
            await kv.put(indexKey, JSON.stringify(updated));
        }
        return { success: true };
    },

    async delete(ids, env) {
        if (!env.VECTOR_STORE_KV) throw new Error('VECTOR_STORE_KV binding not configured');
        const kv = env.VECTOR_STORE_KV;
        await Promise.all(ids.map((id) => kv.delete(`vector:${id}`)));
        // update project indices
        const list = await kv.list({ prefix: 'project_index:' });
        for (const k of list.keys) {
            const indexArr = (await kv.get(k.name, 'json')) || [];
            const filtered = indexArr.filter((id) => !ids.includes(id));
            if (filtered.length !== indexArr.length) {
                await kv.put(k.name, JSON.stringify(filtered));
            }
        }
        return { success: true, deletedCount: ids.length };
    },

    async query(queryVector, options, env) {
        if (!env.VECTOR_STORE_KV) throw new Error('VECTOR_STORE_KV binding not configured');
        const { topK = 10, returnMetadata = true, projectId } = options;
        const kv = env.VECTOR_STORE_KV;
        let vectorIds;
        if (projectId) {
            vectorIds = (await kv.get(`project_index:${projectId}`, 'json')) || [];
        } else {
            const all = await kv.list({ prefix: 'vector:' });
            vectorIds = all.keys.map((k) => k.name.replace('vector:', ''));
        }
        const vectors = (await Promise.all(
            vectorIds.map((id) => kv.get(`vector:${id}`, 'json'))
        )).filter(Boolean);
        const sims = vectors.map((v) => ({
            id: v.id,
            score: cosineSimilarity(queryVector, v.values),
            metadata: v.metadata,
        }));
        sims.sort((a, b) => b.score - a.score);
        const matches = sims.slice(0, topK).map((m) => ({
            id: m.id,
            score: m.score,
            metadata: returnMetadata ? m.metadata : undefined,
        }));
        return { matches };
    },
};

export const getVectorStore = (env) => {
    return cloudflareKVVectorStore;
};

export default cloudflareKVVectorStore; 