// Values remain rupees in MongoDB/API; addition and subtraction use integer paisa.
export function paisa(value = 0) {
 const n=Number(value ?? 0), units=Math.round(n*100);
 if(!Number.isFinite(n) || !Number.isSafeInteger(units)) throw Object.assign(new Error('Money amount is outside the supported range'),{status:400});
 return units;
}
export function sumMoney(...values) {
 const units=values.reduce((sum,v)=>sum+paisa(v),0);
 if(!Number.isSafeInteger(units)) throw Object.assign(new Error('Money total is outside the supported range'),{status:400});
 return units/100;
}
export function moneyFields(schema, fields) {
 for(const field of fields) schema.path(field).validate({
  validator: value => value == null || (Number.isFinite(value) && Math.abs(value)<=1e9 && Math.abs(value*100-Math.round(value*100))<=Math.max(1e-7,Math.abs(value*100)*Number.EPSILON*2)),
  message: field+' must be a finite PKR amount with at most two decimal places (maximum 1,000,000,000).'
 });
}
