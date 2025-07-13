import { pipeline } from '@xenova/transformers';
import * as ort from 'onnxruntime-node';
import fs from 'fs';
import { z } from 'zod';

interface IndustryPrediction {
  industry: string;
  confidence: number;
  reasoning: string;
}

export const MajorIndustryToolInputSchema = z.object({
  companyNames: z.array(z.string())
})
type MajorIndustryToolInputType = z.infer<typeof MajorIndustryToolInputSchema>;

export async function predictMajorityIndustry(companies: MajorIndustryToolInputType) : Promise<IndustryPrediction> {

  if (!companies.companyNames) throw new Error("No company names provided.");

  // For demonstration, we'll return a mock prediction
  const industries = [
    "Technology", "Finance", "Healthcare", "Retail", 
    "Manufacturing", "Education", "Entertainment", "Real Estate"
  ];
  
  // Simple logic to simulate model prediction
  const prediction = industries[Math.floor(Math.random() * industries.length)];
  const confidence = Math.random() * 0.4 + 0.6; // Between 0.6 and 1.0
  
  return {
    industry: prediction,
    confidence: confidence,
    reasoning: `Based on the company description "${JSON.stringify(companies.companyNames)}", the model predicts this is most likely a ${prediction} company.`
  };

  // if (!companies.companyNames) throw new Error("No company names provided.");
  // // # Load ONNX model
  // const session = await ort.InferenceSession.create('./industry_predictor.onnx');

  // // # Load embedder
  // const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  // // # Predict industries for each company
  // const predictions: number[] = [];

  // for (const name of companies.companyNames) {
  //   const embedding = await embedder(name, { pooling: 'mean', normalize: true });
  //   const tensor = new ort.Tensor('float32', embedding.data, [1, embedding.data.length]);
  //   const output = await session.run({ float_input: tensor });

  //   // # Get label prediction (assuming output key is 'output_label' or similar)
  //   const prediction = output.output_label.data[0]; // # may be 'label' or another key
  //   predictions.push(prediction);
  // }

  // // # Return majority industry (numeric label)
  // const freq = predictions.reduce((acc, val) => {
  //   acc[val] = (acc[val] || 0) + 1;
  //   return acc;
  // }, {} as Record<number, number>);

  // const majorityLabel = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  // const labelMap: Record<number, string> = JSON.parse(fs.readFileSync('./label_map.json', 'utf-8'));
  // const industryName = labelMap[majorityLabel];  // # majorityLabel is number from ONNX model

  // return industryName;
}