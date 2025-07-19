"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { codebook, type CodebookVariable } from "@/lib/codebook";
import { Badge } from "@/components/ui/badge";

export default function CodebookViewer() {
  return (
    <Accordion type="single" collapsible className="w-full text-sm">
      {codebook.map((variable: CodebookVariable) => (
        <AccordionItem value={variable.id} key={variable.id}>
          <AccordionTrigger className="hover:no-underline">
            <div className="flex flex-col items-start text-left">
              <span className="font-semibold">{variable.label}</span>
              <span className="text-xs text-muted-foreground font-mono">{variable.id}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            <p className="text-muted-foreground">{variable.description}</p>
            {variable.values && (
              <div className="space-y-1 pt-2">
                <h4 className="font-medium text-xs">Values:</h4>
                <div className="flex flex-wrap gap-1">
                {variable.values.map(v => (
                   <Badge variant="outline" key={v.value} className="font-normal">
                      <strong className="mr-1.5 font-mono">{v.value}:</strong> {v.label}
                    </Badge>
                ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
