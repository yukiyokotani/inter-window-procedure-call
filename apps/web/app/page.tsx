import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>IWPC demo</h1>
        <ul>
          <li>
            <a href='./parent1' target='_blank' rel='noopener noreferrer'>
              Parent 1 (postMessage transport)
            </a>
          </li>
          <li>
            <a href='./parent2' target='_blank' rel='noopener noreferrer'>
              Parent 2 (BroadcastChannel transport, no opener)
            </a>
          </li>
        </ul>
      </main>
    </div>
  );
}
