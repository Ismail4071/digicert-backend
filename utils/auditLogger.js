const AuditLog =
require("../models/AuditLog");

const createAuditLog =
async({

action,
performedBy,
certificateId,
details

})=>{

try{

if(!action){
console.log("Audit skipped → No action");
return;
}

await AuditLog.create({

action,
performedBy:
performedBy || null,
certificateId:
certificateId || null,
details:
details || "",
createdAt:new Date()

});

console.log("✅ Audit Log Saved");

}catch(error){

console.error(
"Audit Log Error :",
error.message
);

}

};

module.exports =
createAuditLog;