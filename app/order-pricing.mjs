export function calculateOrderTotals(lines,adjustmentAmounts,discountAmount,vatApplied,shippingFee=0){
 // Each line's unit price already includes its selected hardware. Add every
 // extra and shipping fee to the taxable base after applying the discount.
 const itemSubtotal=round(lines.reduce((sum,line)=>sum+positive(line.quantity)*positive(line.unitPrice),0));
 const adjustmentsTotal=round(adjustmentAmounts.reduce((sum,amount)=>sum+positive(amount),0));
 const grossSubtotal=round(itemSubtotal+adjustmentsTotal);
 const discount=round(Math.min(positive(discountAmount),grossSubtotal));
 const subtotal=round(grossSubtotal-discount);
 const vatAmount=vatApplied?round((subtotal+positive(shippingFee))*0.07):0;
 return{itemSubtotal,adjustmentsTotal,grossSubtotal,discount,subtotal,vatAmount,total:round(subtotal+vatAmount)};
}
const positive=(value)=>Number.isFinite(value)?Math.max(0,value):0;
const round=(value)=>Math.round((value+Number.EPSILON)*100)/100;
