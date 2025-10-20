/*import fastforex from '@api/fastforex';
fastforex.auth(process.env.FASTFOREST_API_KEY || '');

class FastForexService {
    async getOne(from: string, to: string) {
        return (await fastforex.getFetchOne({from, to})).data
    }

    async getConvert(from: string, to: string, amount: number, precision: number = 3) {
        return (await fastforex.getConvert({from, to, amount, precision})).data
    }

    async getMulti(from: string, to: string) {
        return (await fastforex.getFetchMulti({from, to})).data
    }
}

export default new FastForexService();*/