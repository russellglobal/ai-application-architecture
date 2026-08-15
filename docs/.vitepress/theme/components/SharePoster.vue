<template>
  <div class="share-poster-section" v-if="showPoster">
    <p class="share-tip">📱 长按上方海报图片，保存后分享到朋友圈或朋友</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

const showPoster = computed(() => {
  const path = route.path.replace(/\.html$/, '')
  // 不在首页、关于、产品、404 页面显示
  return !['/', '/about', '/products', '/404'].includes(path)
})
</script>

<style scoped>
.share-poster-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
  text-align: center;
}

.share-tip {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  margin: 1.5rem 0 0 0;
}
</style>
