import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { RotateCcw, FileText } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface ReturnsReportProps {
  returns: any[];
}

export function ReturnsReport({ returns }: ReturnsReportProps) {
  // Calculate total return amount
  const totalReturnAmount = returns.reduce((sum, ret) => sum + ret.totalAmount, 0);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="size-5 text-red-600" />
              Returns Report
            </CardTitle>
            <CardDescription className="mt-1">
              View all processed returns
            </CardDescription>
          </div>
          <Badge className="bg-gradient-to-r from-red-500 to-red-600">
            {returns.length} Returns
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4">
              <p className="text-sm text-red-600 font-medium">Total Returns</p>
              <p className="text-2xl font-bold text-red-700">{returns.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4">
              <p className="text-sm text-red-600 font-medium">Total Return Amount</p>
              <p className="text-2xl font-bold text-red-700">PKR {totalReturnAmount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4">
              <p className="text-sm text-red-600 font-medium">Average Return</p>
              <p className="text-2xl font-bold text-red-700">
                PKR {returns.length > 0 ? Math.round(totalReturnAmount / returns.length).toLocaleString() : 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          {returns.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-gray-500">
              <div className="text-center">
                <RotateCcw className="size-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No Returns Found</p>
                <p className="text-sm text-gray-400 mt-2">Returns will appear here when processed</p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Return ID</TableHead>
                      <TableHead>Original Order</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead className="text-center">Type</TableHead>
                      <TableHead className="text-center">Items</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returns.map((returnItem) => (
                      <TableRow key={returnItem.id} className="hover:bg-red-50">
                        <TableCell className="font-semibold text-red-600">
                          {returnItem.id}
                        </TableCell>
                        <TableCell className="font-medium text-[#C7359C]">
                          {returnItem.saleId}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{new Date(returnItem.date).toLocaleDateString()}</p>
                            <p className="text-gray-500 text-xs">{new Date(returnItem.date).toLocaleTimeString()}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={returnItem.returnType === 'complete' ? 'destructive' : 'outline'}>
                            {returnItem.returnType === 'complete' ? 'Complete' : 'Partial'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{returnItem.items.length}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          PKR {returnItem.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            {returnItem.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-gray-600 truncate max-w-xs" title={returnItem.reason}>
                            {returnItem.reason}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-3">
                {returns.map((returnItem) => (
                  <div
                    key={returnItem.id}
                    className="border border-red-200 rounded-lg p-4 space-y-3 hover:border-red-400 transition-colors bg-white"
                  >
                    {/* Return Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-red-600 text-base">{returnItem.id}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Original: <span className="text-[#C7359C] font-medium">{returnItem.saleId}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(returnItem.date).toLocaleDateString()} • {new Date(returnItem.date).toLocaleTimeString()}
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        {returnItem.status}
                      </Badge>
                    </div>

                    {/* Return Details */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-red-100">
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <Badge variant={returnItem.returnType === 'complete' ? 'destructive' : 'outline'} className="mt-1">
                          {returnItem.returnType === 'complete' ? 'Complete' : 'Partial'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Items</p>
                        <Badge variant="outline" className="mt-1">{returnItem.items.length}</Badge>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="text-sm font-semibold text-red-600">PKR {returnItem.totalAmount.toLocaleString()}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Reason</p>
                        <p className="text-sm text-gray-700">{returnItem.reason}</p>
                      </div>
                    </div>

                    {/* Returned Items */}
                    <div className="pt-3 border-t border-red-100">
                      <p className="text-xs text-gray-500 mb-2">Returned Items ({returnItem.items.length})</p>
                      <div className="space-y-1.5">
                        {returnItem.items.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm bg-red-50 rounded px-2 py-1.5">
                            <span className="text-gray-700 truncate flex-1">{item.productName || item.name}</span>
                            <span className="text-gray-600 ml-2">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
