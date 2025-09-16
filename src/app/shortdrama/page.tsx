/* eslint-disable no-console,react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import ShortDramaSelector from '@/components/ShortDramaSelector';
import VideoCard from '@/components/VideoCard';

interface ShortDramaItem {
  id: number;
  vod_id?: number;
  name: string;
  cover: string;
  score?: string;
  update_time?: string;
  total_episodes?: string;
  vod_class?: string;
  vod_tag?: string;
  book_id?: string;
}

// 缓存接口
interface CategoryCache {
  data: ShortDramaItem[];
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

function ShortDramaPageClient() {
  const [shortDramaData, setShortDramaData] = useState<ShortDramaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 选择器状态 - 默认选择穿越分类 (type_id: 1)
  const [selectedCategory, setSelectedCategory] = useState<string>('1');

  // 用于存储最新参数值的 refs
  const currentParamsRef = useRef({
    selectedCategory: '1',
    currentPage: 1,
  });

  // 分类数据缓存
  const categoryCacheRef = useRef<Record<string, CategoryCache>>({});

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  // 同步最新参数值到 ref
  useEffect(() => {
    currentParamsRef.current = {
      selectedCategory,
      currentPage,
    };
  }, [selectedCategory, currentPage]);

  // 参数快照比较函数
  const isSnapshotEqual = useCallback(
    (
      snapshot1: {
        selectedCategory: string;
        currentPage: number;
      },
      snapshot2: {
        selectedCategory: string;
        currentPage: number;
      }
    ) => {
      return (
        snapshot1.selectedCategory === snapshot2.selectedCategory &&
        snapshot1.currentPage === snapshot2.currentPage
      );
    },
    []
  );

  // 获取分类名称
  const getCategoryName = (categoryId: string) => {
    const categories = {
      '1': '穿越',
      '2': '古装',
      '3': '现代',
      '4': '都市',
      '5': '言情',
      '6': '悬疑',
      '7': '喜剧',
      '8': '重生'
    };
    return categories[categoryId as keyof typeof categories] || '穿越';
  };

  // 检查缓存中是否有数据
  const checkCache = useCallback((category: string, page: number) => {
    const cacheKey = `${category}-${page}`;
    return categoryCacheRef.current[cacheKey];
  }, []);

  // 保存数据到缓存
  const saveToCache = useCallback((category: string, page: number, data: ShortDramaItem[], totalPages: number, hasMore: boolean) => {
    const cacheKey = `${category}-${page}`;
    categoryCacheRef.current[cacheKey] = {
      data,
      currentPage: page,
      totalPages,
      hasMore
    };
  }, []);

  // 防抖的数据加载函数
  const loadInitialData = useCallback(async () => {
    // 创建当前参数的快照
    const requestSnapshot = {
      selectedCategory,
      currentPage: 1,
    };

    try {
      setLoading(true);
      
      // 检查缓存中是否有数据
      const cachedData = checkCache(selectedCategory, 1);
      if (cachedData) {
        // 使用缓存数据
        setShortDramaData(cachedData.data);
        setTotalPages(cachedData.totalPages);
        setHasMore(cachedData.hasMore);
        setLoading(false);
        return;
      }

      // 确保在加载初始数据时重置页面状态
      setShortDramaData([]);
      setCurrentPage(1);
      setHasMore(true);
      setIsLoadingMore(false);

      const categoryName = getCategoryName(selectedCategory);
      
      const url = `https://api.xingzhige.com/API/playlet/?keyword=${encodeURIComponent(categoryName)}&page=1`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.code === 0 && data.data) {
        // 检查参数是否仍然一致，如果一致才设置数据
        const currentSnapshot = { ...currentParamsRef.current };

        if (isSnapshotEqual(requestSnapshot, currentSnapshot)) {
          // 转换API返回的数据格式
          const formattedData: ShortDramaItem[] = data.data.map((item: any) => ({
            id: parseInt(item.book_id) || 0,
            vod_id: parseInt(item.book_id) || 0,
            book_id: item.book_id,
            name: item.title,
            cover: item.cover,
            score: item.score || '0',
            update_time: item.update_time || '',
            total_episodes: item.total_episodes || '0',
            vod_class: item.category_schema || '',
            vod_tag: item.category_schema || ''
          }));
          
          // 保存到缓存
          saveToCache(selectedCategory, 1, formattedData, 10, formattedData.length !== 0 && 1 < 10);
          
          setShortDramaData(formattedData);
          setTotalPages(10); // 假设有10页数据
          setHasMore(formattedData.length !== 0 && 1 < 10);
          setLoading(false);
        }
      } else {
        throw new Error(data.msg || '获取数据失败');
      }
    } catch (err) {
      console.error('加载短剧数据失败:', err);
      setLoading(false);
    }
  }, [selectedCategory, isSnapshotEqual, checkCache, saveToCache]);

  // 加载数据
  useEffect(() => {
    // 清除之前的防抖定时器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 使用防抖机制加载数据，避免连续状态更新触发多次请求
    debounceTimeoutRef.current = setTimeout(() => {
      loadInitialData();
    }, 100); // 100ms 防抖延迟

    // 清理函数
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [selectedCategory, loadInitialData]);

  // 单独处理 currentPage 变化（加载更多）
  useEffect(() => {
    if (currentPage > 1) {
      const fetchMoreData = async () => {
        // 创建当前参数的快照
        const requestSnapshot = {
          selectedCategory,
          currentPage,
        };

        try {
          setIsLoadingMore(true);

          // 检查缓存中是否有数据
          const cachedData = checkCache(selectedCategory, currentPage);
          if (cachedData) {
            // 使用缓存数据
            setShortDramaData(prev => [...prev, ...cachedData.data]);
            setHasMore(cachedData.hasMore);
            setIsLoadingMore(false);
            return;
          }

          const categoryName = getCategoryName(selectedCategory);
          
          const url = `https://api.xingzhige.com/API/playlet/?keyword=${encodeURIComponent(categoryName)}&page=${currentPage}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.code === 0 && data.data) {
            // 转换API返回的数据格式
            const formattedData: ShortDramaItem[] = data.data.map((item: any) => ({
              id: parseInt(item.book_id) || 0,
              vod_id: parseInt(item.book_id) || 0,
              book_id: item.book_id,
              name: item.title,
              cover: item.cover,
              score: item.score || '0',
              update_time: item.update_time || '',
              total_episodes: item.total_episodes || '0',
              vod_class: item.category_schema || '',
              vod_tag: item.category_schema || ''
            }));

            // 检查参数是否仍然一致，如果一致才设置数据
            const currentSnapshot = { ...currentParamsRef.current };

            if (isSnapshotEqual(requestSnapshot, currentSnapshot)) {
              // 保存到缓存
              saveToCache(selectedCategory, currentPage, formattedData, totalPages, formattedData.length !== 0 && currentPage < totalPages);
              
              setShortDramaData((prev) => [...prev, ...formattedData]);
              setHasMore(formattedData.length !== 0 && currentPage < totalPages);
            } else {
              // 参数不一致，忽略此次响应
              console.log('参数已变更，忽略过期的数据响应');
            }
          } else {
            throw new Error(data.msg || '获取更多数据失败');
          }
        } catch (err) {
          console.error('加载更多短剧数据失败:', err);
          
          // 即使出错也继续尝试下一页
          if (currentPage < totalPages) {
            setHasMore(true);
          }
        } finally {
          setIsLoadingMore(false);
        }
      };

      fetchMoreData();
    }
  }, [currentPage, selectedCategory, totalPages, isSnapshotEqual, checkCache, saveToCache]);

  // 设置滚动监听
  useEffect(() => {
    // 如果没有更多数据或正在加载，则不设置监听
    if (!hasMore || isLoadingMore || loading) {
      return;
    }

    // 确保 loadingRef 存在
    if (!loadingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          // 自动加载下一页
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loading]);

  // 处理选择器变化
  const handleCategoryChange = useCallback(
    (category: string) => {
      if (category !== selectedCategory) {
        setLoading(true);
        setCurrentPage(1);
        setShortDramaData([]);
        setHasMore(true);
        setIsLoadingMore(false);
        setSelectedCategory(category);
      }
    },
    [selectedCategory]
  );

  return (
    <PageLayout activePath='/shortdrama'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题和选择器 */}
        <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
          {/* 页面标题 */}
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200'>
              短剧
            </h1>
            <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
              精彩短剧，尽在掌握
            </p>
          </div>

          {/* 选择器组件 */}
          <div className='bg-white/60 dark:bg-gray-800/40 rounded-2xl p-4 sm:p-6 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm'>
            <ShortDramaSelector
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryChange}
            />
          </div>
        </div>

        {/* 内容展示区域 */}
        <div className='max-w-[95%] mx-auto mt-8 overflow-visible'>
          {/* 内容网格 */}
          <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
            {loading
              ? // 显示骨架屏
              skeletonData.map((index) => <DoubanCardSkeleton key={index} />)
              : // 显示实际数据
              Array.isArray(shortDramaData) && shortDramaData.length > 0
                ? shortDramaData.map((item, index) => {
                  const videoId = item.book_id || item.vod_id?.toString() || item.id.toString();
                  return (
                    <div key={`${item.name}-${item.id}-${index}`} className='w-full'>
                      <VideoCard
                        from='shortdrama'
                        id={videoId}
                        title={item.name}
                        poster={item.cover}
                        rate={item.score ? item.score.toString() : ''}
                        year={item.update_time ? new Date(item.update_time).getFullYear().toString() : ''}
                        type='tv'
                        source='shortdrama'
                        source_name='短剧'
                        episodes={item.total_episodes ? parseInt(item.total_episodes) || 1 : 1}
                        vod_class={item.vod_class}
                        vod_tag={item.vod_tag}
                      />
                    </div>
                  );
                })
                : null}
          </div>

          {/* 加载更多指示器 */}
          {hasMore && !loading && (
            <div
              ref={(el) => {
                if (el && el.offsetParent !== null) {
                  (
                    loadingRef as React.MutableRefObject<HTMLDivElement | null>
                  ).current = el;
                }
              }}
              className='flex justify-center mt-12 py-8'
            >
              {isLoadingMore && (
                <div className='flex items-center gap-2'>
                  <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500'></div>
                  <span className='text-gray-600 dark:text-gray-400'>加载中...</span>
                </div>
              )}
            </div>
          )}

          {/* 没有更多数据提示 */}
          {!hasMore && shortDramaData.length > 0 && (
            <div className='text-center text-gray-500 dark:text-gray-400 py-8'>
              已加载全部内容
            </div>
          )}

          {/* 空状态 */}
          {!loading && (!Array.isArray(shortDramaData) || shortDramaData.length === 0) && (
            <div className='text-center text-gray-500 dark:text-gray-400 py-8'>
              暂无相关内容
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function ShortDramaPage() {
  return (
    <Suspense>
      <ShortDramaPageClient />
    </Suspense>
  );
}
