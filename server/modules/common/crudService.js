import {
  drizzleListRows,
  drizzleGetRow,
  drizzleCreateRow,
  drizzleUpdateRow,
  drizzleDeleteRow,
  drizzleReplaceRows,
} from "../../db/drizzleCrud.js"

export const crudService = {
  async list({ resource, query, headers }) {
    return await drizzleListRows({ resource, query, headers })
  },
  async get({ resource, id, query, headers }) {
    return await drizzleGetRow({ resource, id, query, headers })
  },
  async create({ resource, body, headers }) {
    return await drizzleCreateRow({ resource, body, headers })
  },
  async update({ resource, id, body, headers }) {
    return await drizzleUpdateRow({ resource, id, body, headers })
  },
  async delete({ resource, id, headers }) {
    return await drizzleDeleteRow({ resource, id, headers })
  },
  async replace({ resource, body, headers }) {
    return await drizzleReplaceRows({ resource, body, headers })
  },
}
