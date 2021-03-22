import { IdMap } from "medusa-test-utils"
import { request } from "../../../../../helpers/test-request"
import { DiscountServiceMock } from "../../../../../services/__mocks__/discount"

const defaultFields = [
  "id",
  "code",
  "is_dynamic",
  "rule_id",
  "parent_discount_id",
  "starts_at",
  "ends_at",
  "created_at",
  "updated_at",
  "deleted_at",
  "metadata",
]

const defaultRelations = [
  "rule",
  "parent_discount",
  "regions",
  "rule.valid_for",
]

describe("DELETE /admin/discounts/:discount_id/products/:variant_id", () => {
  describe("successful addition", () => {
    let subject

    beforeAll(async () => {
      subject = await request(
        "DELETE",
        `/admin/discounts/${IdMap.getId("total10")}/products/${IdMap.getId(
          "testVariant"
        )}`,
        {
          adminSession: {
            jwt: {
              userId: IdMap.getId("admin_user"),
            },
          },
        }
      )
    })

    it("returns 200", () => {
      expect(subject.status).toEqual(200)
    })

    it("calls service retrieve", () => {
      expect(DiscountServiceMock.retrieve).toHaveBeenCalledTimes(1)
      expect(DiscountServiceMock.retrieve).toHaveBeenCalledWith(
        IdMap.getId("total10"),
        {
          select: defaultFields,
          relations: defaultRelations,
        }
      )

      expect(DiscountServiceMock.removeValidProduct).toHaveBeenCalledTimes(1)
      expect(DiscountServiceMock.removeValidProduct).toHaveBeenCalledWith(
        IdMap.getId("total10"),
        IdMap.getId("testVariant")
      )
    })
  })
})
