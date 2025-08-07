
import React from 'react';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/src/components/ui/card";
import { Lightbulb } from "lucide-react";

const queryExamples = [
    "Count the number of respondents from each country.",
    "What is the average age of respondents?",
    "Show the distribution of trust in the legal system.",
    "List the top 5 countries with the highest satisfaction with democracy.",
];

const analysisExamples = [
    "Is there a relationship between years of education and trust in politicians?",
    "Does gender influence how safe people feel walking alone after dark?",
    "Compare the level of happiness between people who are employed and unemployed.",
    "Run a linear regression to predict life satisfaction based on age, gender, and income.",
];

export default function ExamplesPanel() {
  return (
    <div className="flex h-[65vh] flex-col gap-4">
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-lg flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-400" />
                        Basic Data Queries
                    </CardTitle>
                    <CardDescription>
                        Ask for specific data points, counts, averages, and rankings.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc space-y-2 pl-5">
                        {queryExamples.map((prompt, index) => (
                            <li key={index}><code className="font-mono text-sm">{prompt}</code></li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-lg flex items-center gap-2">
                         <Lightbulb className="h-5 w-5 text-yellow-400" />
                        Statistical Analysis
                    </CardTitle>
                    <CardDescription>
                        Explore relationships and predictions in the data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc space-y-2 pl-5">
                        {analysisExamples.map((prompt, index) => (
                           <li key={index}><code className="font-mono text-sm">{prompt}</code></li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
