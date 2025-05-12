// 1. Divide the group into matrix of gender and whether HbA1c >= 5.7 (recommended)
// Male with high HbA1c: 13, 11, 9
// Male awith low HbA1c: 14, 16, 2, 12
// Female with high HbA1c: 5, 6, 10, 4
// Female with low HbA1c: 7, 1, 15, 8
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
      ...row,
      line: Number(row.line), // or just +row.line
      depth: Number(row.depth),
      length: Number(row.length),
      date: new Date(row.date + 'T00:00' + row.timezone),
      datetime: new Date(row.datetime),
    }));
    return data;
}