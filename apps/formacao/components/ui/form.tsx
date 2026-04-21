"use client";

import { FormProvider, type FieldValues, type UseFormReturn } from "react-hook-form";

type FormProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  children: React.ReactNode;
};

export function Form<TFieldValues extends FieldValues>({ form, children }: FormProps<TFieldValues>) {
  return <FormProvider {...form}>{children}</FormProvider>;
}
