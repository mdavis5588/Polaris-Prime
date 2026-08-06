import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles({
  svg: {
    width: 'auto',
    height: 28,
  },
  ring: {
    fill: 'none',
    stroke: '#8b5cf6',
    strokeWidth: 2,
  },
  dot: {
    fill: '#8b5cf6',
  },
});

export const LogoIcon = () => {
  const classes = useStyles();

  return (
    <svg
      className={classes.svg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
    >
      <circle className={classes.ring} cx="14" cy="14" r="12" />
      <circle className={classes.dot} cx="14" cy="14" r="3" />
    </svg>
  );
};
