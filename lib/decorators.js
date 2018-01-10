"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var inflected_1 = require("inflected");
var model_1 = require("./model");
var attribute_1 = require("./attribute");
var associations_1 = require("./associations");
function ModelDecorator(config) {
    return function (target) {
        modelFactory(target, config);
        return target;
    };
}
exports.Model = ModelDecorator;
function initModel(modelClass, config) {
    modelFactory(modelClass, config);
}
exports.initModel = initModel;
function modelFactory(ModelClass, config) {
    ensureModelInheritance(ModelClass);
    model_1.applyModelConfig(ModelClass, config || {});
    if (!ModelClass.jsonapiType && !ModelClass.isBaseClass) {
        ModelClass.jsonapiType = inflected_1.pluralize(inflected_1.underscore(ModelClass.name));
    }
    ModelClass.registerType();
}
function AttrDecoratorFactory(configOrTarget, propertyKey, attrConfig) {
    var attrDefinition = new attribute_1.Attribute({ name: propertyKey });
    var attrFunction = function (ModelClass, propertyKey) {
        ensureModelInheritance(ModelClass);
        if (!attrDefinition.name) {
            attrDefinition.name = propertyKey;
        }
        ModelClass.attributeList[propertyKey] = attrDefinition;
        attrDefinition.apply(ModelClass);
        return attrDefinition.descriptor();
    };
    if ((model_1.isModelClass(configOrTarget) ||
        model_1.isModelInstance(configOrTarget))) {
        // For type checking. Can't have a model AND no property key
        if (!propertyKey) {
            throw new Error('Must provide a propertyKey');
        }
        var target = configOrTarget;
        if (model_1.isModelClass(target)) {
            if (attrConfig) {
                attrDefinition = new attribute_1.Attribute(attrConfig);
            }
            attrFunction(target, propertyKey);
        }
        else {
            return attrFunction(target.constructor, propertyKey);
        }
    }
    else {
        if (configOrTarget) {
            attrDefinition = new attribute_1.Attribute(configOrTarget);
        }
        return function (target, propertyKey) {
            return attrFunction(target.constructor, propertyKey);
        };
    }
}
exports.Attr = AttrDecoratorFactory;
function ensureModelInheritance(ModelClass) {
    if (ModelClass.currentClass !== ModelClass) {
        ModelClass.currentClass.inherited(ModelClass);
    }
}
/*
 * Yup that's a super-Java-y method name.  Decorators in
 * ES7/TS are either of the form:
 *
 * @decorator foo : string
 * or
 * @decorator(options) foo : string
 *
 * The first is a function that directly decorates the
 * property, while this second is a factory function
 * that returns a decorator function.
 *
 * This method builds the factory function for each of our
 * association types.
 *
 * Additionally, users without decorator support can apply these
 * to their ES6-compatible classes directly if they prefer:
 *
 * ``` javascript
 * class Person extends ApplicationRecord {
 *   fullName() { `${this.firstName} ${this.lastName} `}
 * }
 * Attr(Person, 'firstName')
 * Attr(Person, 'lastName')
 * BelongsTo(Person, 'mother', { type: Person })
 * ```
 *
 */
function AssociationDecoratorFactoryBuilder(AttrType) {
    function DecoratorFactory(targetOrConfig, propertyKey, optsOrType) {
        function extend(ModelClass) {
            ensureModelInheritance(ModelClass);
            return ModelClass;
        }
        var opts;
        var factoryFn = function (target, propertyKey) {
            if (optsOrType === undefined) {
                var inferredType = inflected_1.pluralize(inflected_1.underscore(propertyKey));
                opts = {
                    jsonapiType: inferredType
                };
            }
            else if (typeof optsOrType === 'string') {
                opts = {
                    jsonapiType: optsOrType
                };
            }
            else if (model_1.isModelClass(optsOrType)) {
                opts = {
                    type: optsOrType
                };
            }
            else {
                opts = {
                    persist: optsOrType.persist,
                    name: optsOrType.name,
                };
                if (typeof optsOrType.type === 'string') {
                    opts.jsonapiType = optsOrType.type;
                }
                else {
                    opts.type = optsOrType.type;
                }
            }
            var attrDefinition = new AttrType(opts);
            if (!attrDefinition.name) {
                attrDefinition.name = propertyKey;
            }
            var ModelClass = extend(target.constructor);
            ModelClass.attributeList[propertyKey] = attrDefinition;
            attrDefinition.owner = target.constructor;
            attrDefinition.apply(ModelClass);
            attrDefinition.descriptor();
        };
        if (model_1.isModelClass(targetOrConfig)) {
            if (!propertyKey) {
                optsOrType = targetOrConfig;
                return factoryFn;
            }
            var target = targetOrConfig;
            factoryFn(target.prototype, propertyKey);
        }
        else {
            optsOrType = targetOrConfig;
            return factoryFn;
        }
    }
    return DecoratorFactory;
}
var HasManyDecoratorFactory = AssociationDecoratorFactoryBuilder(associations_1.HasMany);
exports.HasMany = HasManyDecoratorFactory;
var HasOneDecoratorFactory = AssociationDecoratorFactoryBuilder(associations_1.HasOne);
exports.HasOne = HasOneDecoratorFactory;
var BelongsToDecoratorFactory = AssociationDecoratorFactoryBuilder(associations_1.BelongsTo);
exports.BelongsTo = BelongsToDecoratorFactory;
//# sourceMappingURL=decorators.js.map