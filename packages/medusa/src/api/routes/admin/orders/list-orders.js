import _ from "lodash"
import { defaultRelations, defaultFields, filterableFields } from "./"
import { MedusaError, Validator } from "medusa-core-utils"

export default async (req, res) => {
  const schema = Validator.orderFilter()

  const { value, error } = schema.validate(req.query)

  if (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, error.details)
  }

  try {
    const orderService = req.scope.resolve("orderService")

    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0

    let selector = {}

    if ("q" in req.query) {
      selector.q = req.query.q
    }

    let includeFields = []
    if ("fields" in req.query) {
      includeFields = req.query.fields.split(",")
      // Ensure created_at is included, since we are sorting on this
      includeFields.push("created_at")
    }

    let expandFields = []
    if ("expand" in req.query) {
      expandFields = req.query.expand.split(",")
    }

    for (const k of filterableFields) {
      if (k in value) {
        selector[k] = value[k]
      }
    }

    const listConfig = {
      select: includeFields.length ? includeFields : defaultFields,
      relations: expandFields.length ? expandFields : defaultRelations,
      skip: offset,
      take: limit,
      order: { created_at: "DESC" },
    }

    const [orders, count] = await orderService.listAndCount(
      selector,
      listConfig
    )

    let data = orders

    const fields = [...includeFields, ...expandFields]
    if (fields.length) {
      data = orders.map(o => _.pick(o, fields))
    }

    res.json({ orders: data, count, offset, limit })
  } catch (error) {
    throw error
  }
}
