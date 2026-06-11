#!/bin/bash
# Script para comprimir modelos GLB para uso web
# Reduz tamanho drásticamente mantendo qualidade visual

INPUT="$1"
OUTPUT="$2"

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
  echo "Uso: ./compress-glb.sh <input.glb> <output.glb>"
  exit 1
fi

echo "📦 Comprimindo: $INPUT → $OUTPUT"
echo ""

# Etapa 1: Draco (comprime geometria - reduz 60-80%)
echo "🔧 Etapa 1/4: Compressão Draco..."
gltf-transform draco "$INPUT" "/tmp/step1.glb" 2>&1

# Etapa 2: Resample (otimiza animações)
echo "🔧 Etapa 2/4: Resample..."
gltf-transform resample "/tmp/step1.glb" "/tmp/step2.glb" 2>&1

# Etapa 3: Dedup (remove dados duplicados)
echo "🔧 Etapa 3/4: Dedup..."
gltf-transform dedup "/tmp/step2.glb" "/tmp/step3.glb" 2>&1

# Etapa 4: Texture resize (redimensiona texturas grandes)
echo "🔧 Etapa 4/4: Resize de texturas (max 1024x1024)..."
gltf-transform resize "/tmp/step3.glb" "$OUTPUT" --width 1024 --height 1024 2>&1

# Limpeza
rm -f /tmp/step1.glb /tmp/step2.glb /tmp/step3.glb

# Resultado
ORIG_SIZE=$(du -h "$INPUT" | cut -f1)
FINAL_SIZE=$(du -h "$OUTPUT" | cut -f1)

echo ""
echo "✅ Pronto!"
echo "📊 Tamanho original: $ORIG_SIZE"
echo "📊 Tamanho final:    $FINAL_SIZE"
