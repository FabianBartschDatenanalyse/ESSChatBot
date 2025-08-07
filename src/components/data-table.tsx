import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table"

interface DataTableProps {
  columns: string[];
  data: Record<string, any>[];
}

export function DataTable({ columns, data }: DataTableProps) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground">No results to display.</p>
  }
  
  const headers = columns.length > 0 ? columns : Object.keys(data[0]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header} className="font-bold font-headline capitalize">{header.replace(/_/g, ' ')}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {headers.map((header) => (
                <TableCell key={`${rowIndex}-${header}`}>
                  {typeof row[header] === 'number' ? row[header].toFixed(2) : String(row[header])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
