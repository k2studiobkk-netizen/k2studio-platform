import test from "node:test";
import assert from "node:assert/strict";
import { manualPayoutPreview, referralProgramPolicy, reviewReferralSale } from "../app/referral-program-policy.mjs";

const now = "2026-09-21T07:00:00Z";
const sale = {event:"product_sale",orderId:"ORDER-1",buyerId:"buyer",ruleVersion:"review-v1",paymentVerified:true,
  fulfillmentStatus:"completed",returnWindowEndsAt:"2026-09-20T07:00:00Z",disputeOpen:false,
  itemNetSatang:100000,refundedItemNetSatang:0,payableSatang:112000,receivedSatang:112000};
const chain = ["direct","parent","grandparent"].map(memberId=>({memberId,active:true,verified:true}));

test("manual payout policy cannot call a gateway or reward recruitment",()=>{
  assert.equal(referralProgramPolicy.payoutProvider,null);
  assert.equal(referralProgramPolicy.payoutMethod,"company_manual_bank_transfer");
  assert.equal(referralProgramPolicy.payoutExecutionEnabled,false);
  assert.equal(referralProgramPolicy.liveAccrualEnabled,false);
  assert.equal(referralProgramPolicy.recruitmentRewardSatang,0);
  for(const event of ["signup","referral_signup","investment","wallet_deposit",undefined])assert.equal(reviewReferralSale({...sale,event},chain,now).eligible,false);
});
test("manual payout preview uses explicit deductions and never assumes uniform withholding",()=>{
  assert.deepEqual(manualPayoutPreview({grossSatang:10000,withholdingSatang:0,memberFeeSatang:0}),{
    grossSatang:10000,withholdingSatang:0,memberFeeSatang:0,netTransferSatang:10000,payoutMethod:"company_manual_bank_transfer",previewOnly:true,transferExecuted:false,
  });
  assert.equal(manualPayoutPreview({grossSatang:100000,withholdingSatang:1700,memberFeeSatang:200}).netTransferSatang,98100);
  for(const change of [{grossSatang:9999},{grossSatang:Infinity},{withholdingSatang:undefined},{withholdingSatang:-1},{memberFeeSatang:1.2},{withholdingSatang:10000},{withholdingSatang:9000,memberFeeSatang:1001}])assert.throws(()=>manualPayoutPreview({grossSatang:10000,withholdingSatang:0,memberFeeSatang:0,...change}));
});
test("only fulfilled, verified paid sales after their refund hold pass a simulation review",()=>{
  const result=reviewReferralSale(sale,chain,now);
  assert.equal(result.eligible,true);assert.equal(result.commissionBaseSatang,100000);assert.equal(result.rewardLevels,3);
  assert.equal(result.liveAccrualEnabled,false);assert.equal(result.ruleVersion,"review-v1");
  assert.equal(reviewReferralSale({...sale,refundedItemNetSatang:25000},chain,now).commissionBaseSatang,75000);
  for(const change of [{paymentVerified:false},{fulfillmentStatus:"cancelled"},{fulfillmentStatus:"packing"},{returnWindowEndsAt:"2026-10-01T00:00:00Z"},{returnWindowEndsAt:null},{disputeOpen:true},{disputeOpen:undefined},{ruleVersion:""},{receivedSatang:10000},{refundedItemNetSatang:100000},{itemNetSatang:-1},{itemNetSatang:200000}])assert.equal(reviewReferralSale({...sale,...change},chain,now).eligible,false);
});
test("review rejects self referrals, cycles, invalid members and more than three levels",()=>{
  for(const bad of [[],null,[null],[{memberId:"buyer",active:true,verified:true}],[chain[0],chain[0]],[...chain,{memberId:"fourth",active:true,verified:true}],[{...chain[0],active:false}],[{...chain[0],verified:false}]])assert.equal(reviewReferralSale(sale,bad,now).eligible,false);
  assert.equal(reviewReferralSale(sale,chain,"invalid").eligible,false);
  assert.equal(reviewReferralSale(sale,chain.slice(0,1),now).rewardLevels,1);
});
