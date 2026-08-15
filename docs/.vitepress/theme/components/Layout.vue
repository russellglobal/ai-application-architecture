<script setup>
import DefaultTheme from 'vitepress/theme'
import { computed } from 'vue'
import { useRoute, useData } from 'vitepress'

const { Layout } = DefaultTheme
const route = useRoute()
const { page } = useData()

const posterSrc = computed(() => {
  const path = route.path.replace(/\.html$/, '')
  const parts = path.split('/').filter(Boolean)
  const fileName = parts[parts.length - 1] || 'index'
  return `/posters/poster-${fileName}.png`
})

const showPoster = computed(() => {
  const path = route.path.replace(/\.html$/, '')
  return !['/', '/about', '/products', '/404'].includes(path)
})
</script>

<template>
  <Layout>
    <!-- 分享海报功能暂时隐藏，后续优化 -->
    <!-- <template #doc-footer-before>
      <div v-if="showPoster" class="share-poster-section">
        <img :src="posterSrc" :alt="page?.title || '分享海报'" class="poster-image" />
        <p class="share-tip">📱 长按上方海报图片，保存后分享到朋友圈或朋友</p>
      </div>
    </template> -->
  </Layout>
</template>

<style scoped>
.share-poster-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
  text-align: center;
  max-width: 375px;
  margin-left: auto;
  margin-right: auto;
}

.poster-image {
  width: 100%;
  height: auto;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: block;
}

.share-tip {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  margin: 1rem 0 0 0;
}
</style>
