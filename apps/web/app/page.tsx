import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <a href='./parent1' target='_blanck' rel='noopener'>
          Parent 1
        </a>
      </main>
    </div>
  );
}
