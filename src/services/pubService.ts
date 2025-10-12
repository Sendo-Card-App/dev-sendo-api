import PubModel from "@models/pub-model";

class PubService {
    async getPubs(limit: number, startIndex: number) {
        return PubModel.findAndCountAll({
            limit,
            offset: startIndex,
            order: [["createdAt", "DESC"]],
        });
    }

    async getPubById(id: number) {
        return PubModel.findByPk(id);
    }

    async createPub(pubData: {
        name?: string;
        imageUrl: string;
        price?: number;
        description?: string;
        link?: string;
    }) {
        return PubModel.create(pubData);
    }

    async updatePub(pubData: {
        id: number;
        name?: string;
        imageUrl?: string;
        price?: number;
        description?: string;
        link?: string;
        isActive?: boolean;
    }) {
        const pub = await PubModel.findByPk(pubData.id);
        if (!pub) {
            throw new Error("Pub not found");
        }
        return pub.update(pubData);
    }

    async deletePub(id: number) {
        const pub = await PubModel.findByPk(id);
        if (!pub) {
            throw new Error("Pub not found");
        }
        return pub.destroy();
    }
}

export default new PubService();