#!/usr/bin/env ruby

lines = File.readlines("apps/web/src/app/(publico)/admissoes/[escolaSlug]/AdmissionForm.tsx")

lines.each_with_index do |line, index|
  if line.include?("{step === 1 && (") && lines[index+6] && lines[index+6].include?("Dados do Responsável")
    lines[index] = line.sub("{step === 1 && (", "{step === 3 && (")
  end
  # Change the next button handler for step 3 to nextStep
  if line.include?("onClick={nextStep}") && lines[index-4] && lines[index-4].include?("Voltar") && lines[index+5] && lines[index+5].include?("{step === 1 && (")
    # This might be tricky. Let's just do it directly.
  end
end

File.write("apps/web/src/app/(publico)/admissoes/[escolaSlug]/AdmissionForm.tsx", lines.join)
