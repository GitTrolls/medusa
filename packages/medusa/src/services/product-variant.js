import _ from "lodash"
import { BaseService } from "../interfaces"
import { Validator, MedusaError } from "medusa-core-utils"

/**
 * Provides layer to manipulate product variants.
 * @implements BaseService
 */
class ProductVariantService extends BaseService {
  /** @param { productVariantModel: (ProductVariantModel) } */
  constructor({ productVariantModel, eventBusService, productService }) {
    super()

    /** @private @const {ProductVariantModel} */
    this.productVariantModel_ = productVariantModel

    /** @private @const {EventBus} */
    this.eventBus_ = eventBusService

    /** @private @const {ProductService} */
    this.productService_ = productService
  }

  /**
   * Used to validate product ids. Throws an error if the cast fails
   * @param {string} rawId - the raw product id to validate.
   * @return {string} the validated id
   */
  validateId_(rawId) {
    const schema = Validator.objectId()
    const { value, error } = schema.validate(rawId)
    if (error) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "The variantId could not be casted to an ObjectId"
      )
    }

    return value
  }

  /**
   * Gets a product variant by id.
   * @param {string} variantId - the id of the product to get.
   * @return {Promise<Product>} the product document.
   */
  retrieve(variantId) {
    const validatedId = this.validateId_(variantId)
    return this.productVariantModel_
      .findOne({ _id: validatedId })
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }

  /**
   * Creates an unpublished product variant.
   * @param {object} variant - the variant to create
   * @return {Promise} resolves to the creation result.
   */
  createDraft(productVariant) {
    return this.productVariantModel_
      .create({
        ...productVariant,
        published: false,
      })
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }

  /**
   * Creates an publishes variant.
   * @param {string} variantId - ID of the variant to publish.
   * @return {Promise} resolves to the creation result.
   */
  publish(variantId) {
    return this.productVariantModel_
      .updateOne({ _id: variantId }, { $set: { published: true } })
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }

  /**
   * Updates a variant. Metadata updates and price updates should
   * use dedicated methods, e.g. `setMetadata`, etc. The function
   * will throw errors if metadata updates and price updates are attempted.
   * @param {string} variantId - the id of the variant. Must be a string that
   *   can be casted to an ObjectId
   * @param {object} update - an object with the update values.
   * @return {Promise} resolves to the update result.
   */
  update(variantId, update) {
    const validatedId = this.validateId_(variantId)

    if (update.metadata) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Use setMetadata to update metadata fields"
      )
    }

    return this.productVariantModel_
      .updateOne(
        { _id: validatedId },
        { $set: update },
        { runValidators: true }
      )
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }

  /**
   * Adds option value to a varaint.
   * Fails when product with variant does not exists or
   * if that product does not have an option with the given
   * option id. Fails if given variant is not found.
   * Option value must be of type string or number.
   * @param {string} variantId - the variant to decorate.
   * @param {string} optionId - the option from product.
   * @param {string | number} optionValue - option value to add.
   * @return {Promise} the result of the update operation.
   */
  async addOptionValue(variantId, optionId, optionValue) {
    const products = await this.productService_.list({ variants: variantId })
    if (!products.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Products with variant: ${variantId} was not found`
      )
    }

    const product = products[0]
    if (!product.options.find(o => o._id === optionId)) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Associated product does not have option: ${optionId}`
      )
    }

    const variant = await this.retrieve(variantId)
    if (!variant) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Variant with ${variantId} was not found`
      )
    }

    if (typeof optionValue !== "string" && typeof optionValue !== "number") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Option value is not of type string or number`
      )
    }

    return this.productVariantModel_.updateOne(
      { _id: variantId },
      { $push: { options: { option_id: optionId, value: `${optionValue}` } } }
    )
  }

  /**
   * Deletes option value from given variant.
   * Fails when product with variant does not exists or
   * if that product has an option with the given
   * option id.
   * This method should only be used from the product service.
   * @param {string} variantId - the variant to decorate.
   * @param {string} optionId - the option from product.
   * @return {Promise} the result of the update operation.
   */
  async deleteOptionValue(variantId, optionId) {
    const products = await this.productService_.list({ variants: variantId })
    if (!products.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Products with variant: ${variantId} was not found`
      )
    }

    const product = products[0]
    if (product.options.find(o => o._id === optionId)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Associated product has option with id: ${optionId}`
      )
    }

    return this.productVariantModel_.updateOne(
      { _id: variantId },
      { $pull: { options: { option_id: optionId } } }
    )
  }

  /**
   * @param {Object} selector - the query object for find
   * @return {Promise} the result of the find operation
   */
  list(selector) {
    return this.productVariantModel_.find(selector)
  }

  /**
   * Deletes a variant from given variant id.
   * @param {string} variantId - the id of the variant to delete. Must be
   *   castable as an ObjectId
   * @return {Promise} the result of the delete operation.
   */
  async delete(variantId) {
    const variant = await this.retrieve(variantId)
    // Delete is idempotent, but we return a promise to allow then-chaining
    if (!variant) {
      return Promise.resolve()
    }

    return this.productVariantModel_
      .deleteOne({ _id: variantId })
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }

  /**
   * Decorates a variant with variant variants.
   * @param {ProductVariant} variant - the variant to decorate.
   * @param {string[]} fields - the fields to include.
   * @param {string[]} expandFields - fields to expand.
   * @return {ProductVariant} return the decorated variant.
   */
  async decorate(variant, fields, expandFields = []) {
    const requiredFields = ["_id", "metadata"]
    const decorated = _.pick(variant, fields.concat(requiredFields))
    return decorated
  }

  /**
   * Dedicated method to set metadata for a variant.
   * To ensure that plugins does not overwrite each
   * others metadata fields, setMetadata is provided.
   * @param {string} variantId - the variant to decorate.
   * @param {string} key - key for metadata field
   * @param {string} value - value for metadata field.
   * @return {Promise} resolves to the updated result.
   */
  setMetadata(variantId, key, value) {
    const validatedId = this.validateId_(variantId)

    if (typeof key !== "string") {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Key type is invalid. Metadata keys must be strings"
      )
    }

    const keyPath = `metadata.${key}`
    return this.productVariantModel_
      .updateOne({ _id: validatedId }, { $set: { [keyPath]: value } })
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }
}

export default ProductVariantService
