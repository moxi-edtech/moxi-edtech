#!/usr/bin/env ruby

content = File.read("apps/web/src/app/(publico)/admissoes/[escolaSlug]/AdmissionForm.tsx")

content.gsub!(/\{step === 1 && \(/, "{step === 'TEMP_1' && (")
content.gsub!(/\{step === 2 && \(/, "{step === 3 && (")
content.gsub!(/\{step === 3 && \(/, "{step === 1 && (")
content.gsub!(/\{step === 'TEMP_1' && \(/, "{step === 2 && (")

# Now update the handles inside the blocks
# We need to make sure the "Próximo Passo" buttons call the right handler.
# In the new Step 1 (old 3), the next handler should be handleStep1Next instead of nextStep.
# In the new Step 2 (old 1), the next handler should be handleStep2Next instead of handleStep1Next.
# In the new Step 3 (old 2), the next handler should be nextStep instead of nextStep.
# Wait, let's just do it manually with sed or ruby regex to be safe.

File.write("apps/web/src/app/(publico)/admissoes/[escolaSlug]/AdmissionForm.tsx", content)
