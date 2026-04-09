"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface UserIdInputProps {
  onSubmit: (userId: string) => void
  isLoading: boolean
  productName: string
  category: string
}

export default function UserIdInput({ onSubmit, isLoading, productName, category }: UserIdInputProps) {
  const [userId, setUserId] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!userId.trim()) {
      setError("Please enter a valid user ID")
      return
    }

    setError("")
    onSubmit(userId)
  }

  const isTopupCategory = category === "topup"
  const bgColor = isTopupCategory ? "bg-white" : "bg-brand-soft-white"

  return (
    <Card className={`w-full ${bgColor} shadow-md`}>
      <CardHeader>
        <CardTitle className="text-xl text-brand-charcoal">Enter User ID</CardTitle>
        <CardDescription className="text-brand-light-gray">
          Please enter your {productName} user ID to continue
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="user-id" className="text-brand-charcoal">
              User ID
            </Label>
            <Input
              id="user-id"
              placeholder="Enter your user ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={`placeholder:text-gray-400 ${error ? "border-red-500" : ""}`}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
