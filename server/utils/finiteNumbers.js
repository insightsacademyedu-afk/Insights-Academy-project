export function finiteNumbers(schema) {
  schema.eachPath((name, type) => {
    if (type.instance === "Number") type.validate(value => value == null || Number.isFinite(value), "Numeric values must be finite");
    if (type.schema) finiteNumbers(type.schema);
  });
}
