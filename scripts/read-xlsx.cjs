const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\Karan Bohara\\Downloads\\Medicines_Report_2026-07-18.xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log("Sheet Name:", sheetName);
console.log("Total Rows:", data.length);
if (data.length > 0) {
  console.log("Columns:", Object.keys(data[0]));
  console.log("First 3 Rows:");
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
}
