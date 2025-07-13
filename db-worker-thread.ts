import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import axios from 'axios';
// import { db } from './src/db/index';

interface WebsiteToTrack {
  id: string;
  url: string;
  etags: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  updatedAt: Date;
}

interface TrackingResult {
  id: string;
  url: string;
  oldEtags: string | null;
  newEtags: string | null;
  hasChanged: boolean;
  error?: string;
}

interface WorkerData {
  websites: WebsiteToTrack[];
  // dbUrl: string;
}

// Check individual website etags
async function checkWebsiteEtags(site: WebsiteToTrack): Promise<TrackingResult> {
  try {
    const response = await axios.head(site.url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebsiteTracker/1.0)',
      }
    });

    const newEtags = response.headers['etag'] || null;
    const hasChanged = site.etags !== newEtags;

    return {
      id: site.id,
      url: site.url,
      oldEtags: site.etags,
      newEtags,
      hasChanged
    };
  } catch (error: String | any) {
    console.log(`Error checking website etags of ${site.url}: `, error);
    return {
      id: site.id,
      url: site.url,
      oldEtags: site.etags,
      newEtags: null,
      hasChanged: false,
      error: error
    };
  }
}

async function runWorkerThread() {
  if (!parentPort) return;

  try {
    const { websites }: WorkerData = workerData;
    const results: TrackingResult[] = [];

    for (const site of websites) {
      const result = await checkWebsiteEtags(site);
      results.push(result);
    }

    parentPort.postMessage({ results });
  } catch (error: String | any) {
    console.error('Error in worker thread: ', error);
    parentPort.postMessage({ error: error });
  }
}

runWorkerThread().catch((error) => {
  if (parentPort) {
    console.log('Error in worker thread: ', error);
    parentPort.postMessage({ error: error.message });
  } else {
    console.log('Error in main thread: ', error);
  }
  process.exit(1);
})