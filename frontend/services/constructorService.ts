import { api } from "./api";

export const constructorService = {
  async getConstructorStandings() {
    const response = await api.get(
      "/constructors/standings"
    );

    return response.data;
  },
};