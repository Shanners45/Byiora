"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Header } from "@/components/header"
import { ArrowLeft, Shield } from "lucide-react"

export function ProductSkeleton() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center text-white">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6 order-1">
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <Skeleton className="w-full h-48 rounded-lg mb-4 bg-gray-200" />
              <Skeleton className="h-8 w-3/4 bg-gray-200" />
            </div>
            <div className="hidden lg:block space-y-6">
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <Skeleton className="h-6 w-1/3 mb-4 bg-gray-200" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full bg-gray-200" />
                  <Skeleton className="h-4 w-full bg-gray-200" />
                  <Skeleton className="h-4 w-5/6 bg-gray-200" />
                  <Skeleton className="h-4 w-4/6 bg-gray-200" />
                </div>
              </div>
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <Skeleton className="h-6 w-1/2 mb-4 bg-gray-200" />
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full rounded-md bg-gray-200" />
                  <Skeleton className="h-12 w-full rounded-md bg-gray-200" />
                  <Skeleton className="h-12 w-full rounded-md bg-gray-200" />
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6 order-2">
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"></div>
                <Skeleton className="h-6 w-1/3 bg-gray-200" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-2xl bg-gray-200" />
                ))}
              </div>
            </div>
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"></div>
                <Skeleton className="h-6 w-1/3 bg-gray-200" />
              </div>
              <Skeleton className="h-12 w-full rounded-md bg-gray-200 mb-2" />
              <Skeleton className="h-4 w-2/3 bg-gray-200" />
            </div>
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"></div>
                <Skeleton className="h-6 w-1/3 bg-gray-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-2xl bg-gray-200" />
                ))}
              </div>
            </div>
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"></div>
                <Skeleton className="h-6 w-1/4 bg-gray-200" />
              </div>
              <Skeleton className="h-14 w-full rounded-lg bg-gray-200 mb-4" />
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-300" />
                <Skeleton className="h-4 w-1/2 bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
