/**
 * @fileoverview Type definitions for fundraiser data
 */

/**
 * @typedef {Object} FundraiserData
 * @property {string} name - The fundraiser name
 * @property {string} campaign - The campaign name
 * @property {string} description - The fundraiser description
 * @property {number} targetAmount - The fundraising target
 * @property {number} raisedAmount - The amount raised so far
 * @property {string} profileUrl - The Raisely profile URL
 * @property {string} raiselyId - The Raisely UUID
 * @property {string} path - The Raisely path/slug (CRITICAL!)
 * @property {string} status - The fundraiser status (ACTIVE, DRAFT, etc.)
 */

/**
 * Validates that fundraiser data has all required fields
 * @param {any} data - The data to validate
 * @returns {FundraiserData|null} - The validated data or null if invalid
 */
function validateFundraiserData(data) {
  const requiredFields = ['name', 'campaign', 'path', 'raiselyId'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      console.error(`❌ Missing required field: ${field}`);
      return null;
    }
  }
  
  // Warn about missing optional but important fields
  const importantFields = ['targetAmount', 'status'];
  for (const field of importantFields) {
    if (data[field] === undefined || data[field] === null) {
      console.warn(`⚠️  Missing optional field: ${field}`);
    }
  }
  
  return data;
}

module.exports = {
  validateFundraiserData
};