// 1. Divide the group into matrix of gender and whether HbA1c >= 5.7 (recommended)
// Male with high HbA1c: 11, 9
// Male awith low HbA1c: 14, 2, 12
// Female with high HbA1c: 5, 6, 10, 4
// Female with low HbA1c: 7, 1, 15, 8

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData(fileName) {
    const data = await d3.csv(fileName);
    return data;
}

function processCommits(data) {
    data.forEach((d) => {
        // d.time = d.time ? 
        d.calorie = +d.calorie;
        d.total_carb = +d.total_carb;
        d.sugar = +d.sugar;
        d.protein = +d.protein;
    });

    data.forEach((d) => {
        if (d.time) {
            d.time = d3.timeParse("%Y-%m-%d %H:%M:%S")(d.time);
        }
    });

    const groupedData = d3.groups(data, 
        (d) => d.calorie, 
        (d) => d.total_carb, 
        (d) => d.sugar, 
        (d) => d.protein
    );

    return groupedData.map(([calorie, carbGroups]) => {
        return carbGroups.map(([total_carb, sugarGroups]) => {
            return sugarGroups.map(([sugar, proteinGroups]) => {
                return proteinGroups.map(([protein, items]) => {
                    return items.map((item) => ({
                        calorie: item.calorie,
                        total_carb: item.total_carb,
                        sugar: item.sugar,
                        protein: item.protein,
                        ...item
                    }));
                });
            }).flat();
        }).flat();
    }).flat();
}

function extractData(processedDatadata, cal_low, cal_high, carb_low, carb_high, sugar_low, sugar_high, protein_low, protein_high) {
    const data = processedData.filter((d) => {
        return (
            d.calorie >= cal_low &&
            d.calorie <= cal_high &&
            d.total_carb >= carb_low &&
            d.total_carb <= carb_high &&
            d.sugar >= sugar_low &&
            d.sugar <= sugar_high &&    
            d.protein >= protein_low &&
            d.protein <= protein_high
        );
    });
    const result = [];
    data.forEach((d) => {
        const { calorie, total_carb, sugar, protein } = d;
        result.push({ calorie, total_carb, sugar, protein });
    });
    return result;
}

const input_data = await loadData('./data/001/summary001.csv');
const processedData = processCommits(input_data);
console.log(processedData)

const male_high = await loadData('./data/male_high.csv');
const processed_male_high = processCommits(male_high);

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label id="gender-scheme">
        Gender:
        <select id="set-gender">
          <option value='male'>Male</option>
          <option value='female'>Female</option>
          <option value='both-mf'>Both</option>
        </select>
    </label>`,
);

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label id="glucose-scheme">
        Glucose:
        <select id="set-glucose">
          <option value='high'>High</option>
          <option value='low'>Low</option>
          <option value='both-hl'>Both</option>
        </select>
    </label>`,
);